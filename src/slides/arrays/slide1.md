---
transition: slide-up
---

<script setup>
const contents = [
  { text: '<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and checks if it is a <b>Positive Number</b> using an <code>if</code> statement.' },
  { text: '<b>Sample Input:</b> <code>12</code>' },
  { text: '<b>Expected Output:</b><br><code>12 is a positive number.</code>' }
]

const testCases = [
  {
    id: 1,
    name: 'Sample 1',
    input: '12',
    expectedOutput: '12 is a positive number.',
    isHidden: false
  },
  {
    id: 2,
    name: 'Sample 2',
    input: '-25',
    expectedOutput: '',
    isHidden: false
  },
  {
    id: 3,
    name: 'Hidden 1',
    input: '-5',
    expectedOutput: '',
    isHidden: true
  },
  {
    id: 4,
    name: 'Hidden 2',
    input: '0',
    expectedOutput: '',
    isHidden: true
  },
  {
    id: 5,
    name: 'Hidden 3',
    input: '100',
    expectedOutput: '100 is a positive number.',
    isHidden: true
  }
]

const starterCode = `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int num = sc.nextInt();
        
        // Write your if condition here
        
    }
}`
</script>

<Slide
  question-slug="check-positive-number"
  topic="Decision-making statements"
  sub-topic="Positive Number Check"
  language="java"
  :contents="contents"
  :test-cases="testCases"
  :starter-code="starterCode"
/>
